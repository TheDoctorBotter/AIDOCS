import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Clock } from 'lucide-react';

interface DateOfServiceFormProps {
  value?: string;
  startTime?: string;
  endTime?: string;
  onChange: (value: string) => void;
  onStartTimeChange?: (value: string) => void;
  onEndTimeChange?: (value: string) => void;
}

function calculateTotalTime(start?: string, end?: string): string | null {
  if (!start || !end) return null;
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  const diff = endMinutes - startMinutes;
  if (diff <= 0) return null;
  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export default function DateOfServiceForm({
  value,
  startTime,
  endTime,
  onChange,
  onStartTimeChange,
  onEndTimeChange,
}: DateOfServiceFormProps) {
  const totalTime = calculateTotalTime(startTime, endTime);

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-600" />
          <CardTitle>Date of Service</CardTitle>
        </div>
        <CardDescription>When was this service provided?</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="dateOfService">Service Date</Label>
            <Input
              id="dateOfService"
              type="date"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="startTime">Start Time</Label>
            <Input
              id="startTime"
              type="time"
              value={startTime || ''}
              onChange={(e) => onStartTimeChange?.(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endTime">End Time</Label>
            <Input
              id="endTime"
              type="time"
              value={endTime || ''}
              onChange={(e) => onEndTimeChange?.(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Total Time</Label>
            <div className="flex items-center h-10 px-3 rounded-md border bg-white text-sm">
              <Clock className="h-4 w-4 text-slate-400 mr-2" />
              <span className={totalTime ? 'text-slate-900 font-medium' : 'text-slate-400'}>
                {totalTime || 'Auto-calculated'}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
