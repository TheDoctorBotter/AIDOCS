'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface DeletePatientDialogProps {
  patientId: string;
  patientName: string;
}

export function DeletePatientDialog({ patientId, patientName }: DeletePatientDialogProps) {
  const router = useRouter();
  const { hasRole, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only show to admins
  if (!hasRole(['admin'])) {
    return null;
  }

  const handleDelete = async () => {
    if (!password || !reason) {
      setError('Password and reason are required');
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/patients/${patientId}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user?.email, password, reason }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete patient');
      }

      // Success - redirect to home
      router.push('/');
    } catch (err) {
      console.error('Error deleting patient:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete patient');
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset form when dialog closes
      setPassword('');
      setReason('');
      setError(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm" className="gap-2">
          <Trash2 className="h-4 w-4" />
          Delete Patient
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Delete Patient
          </DialogTitle>
          <DialogDescription>
            This action will permanently delete <strong>{patientName}</strong> and all associated records.
            This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Admin password verification required to proceed with deletion.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="password">Your Password *</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your admin password"
              disabled={deleting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Deletion *</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this patient is being deleted..."
              rows={4}
              disabled={deleting}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting || !password || !reason}
            className="gap-2"
          >
            {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
            {deleting ? 'Deleting...' : 'Delete Patient'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
