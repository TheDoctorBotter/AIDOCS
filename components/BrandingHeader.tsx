import { BrandingSettings } from '@/lib/types';

interface BrandingHeaderProps {
  settings: BrandingSettings;
  variant?: 'display' | 'print';
}

export default function BrandingHeader({ settings, variant = 'display' }: BrandingHeaderProps) {
  if (!settings.show_in_notes) {
    return null;
  }

  const hasContent =
    settings.clinic_name ||
    settings.address ||
    settings.phone ||
    settings.email ||
    settings.website ||
    settings.logo_url ||
    settings.letterhead_url;

  if (!hasContent) {
    return null;
  }

  const containerClass = variant === 'print'
    ? 'border-b-2 border-slate-800 pb-4 mb-6'
    : 'border-b-2 border-slate-200 pb-4 mb-6';

  if (settings.letterhead_url) {
    return (
      <div className={containerClass}>
        <img
          src={settings.letterhead_url}
          alt="Clinic Letterhead"
          className="w-full max-h-48 object-contain"
        />
      </div>
    );
  }

  if (settings.logo_url) {
    return (
      <div className={containerClass}>
        <div className="flex items-start gap-4">
          <img
            src={settings.logo_url}
            alt="Clinic Logo"
            className="h-16 w-16 object-contain flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            {settings.clinic_name && (
              <h2 className="font-bold text-xl text-slate-900 mb-1">
                {settings.clinic_name}
              </h2>
            )}
            {settings.address && (
              <p className="text-sm text-slate-700 whitespace-pre-line mb-2">
                {settings.address}
              </p>
            )}
            <div className="text-sm text-slate-600 space-y-0.5">
              {settings.phone && <div>Phone: {settings.phone}</div>}
              {settings.email && <div>Email: {settings.email}</div>}
              {settings.website && <div>Web: {settings.website}</div>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <div className="text-center space-y-2">
        {settings.clinic_name && (
          <h2 className="font-bold text-xl text-slate-900">
            {settings.clinic_name}
          </h2>
        )}
        {settings.address && (
          <p className="text-sm text-slate-700 whitespace-pre-line">
            {settings.address}
          </p>
        )}
        <div className="text-sm text-slate-600 space-y-0.5">
          {settings.phone && <div>Phone: {settings.phone}</div>}
          {settings.email && <div>Email: {settings.email}</div>}
          {settings.website && <div>Web: {settings.website}</div>}
        </div>
      </div>
    </div>
  );
}
