'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
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
import { toast } from 'sonner';
import { MessageSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface CallRequestDialogProps {
  creatorId: string;
  creatorName: string;
}

export function CallRequestDialog({ creatorId, creatorName }: CallRequestDialogProps) {
  const t = useTranslations('components.callRequestDialog');
  const tToast = useTranslations('toast');
  const router = useRouter();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    proposedDateTime: '',
    proposedPrice: '',
    message: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error(t('errors.loginRequired'));
      router.push('/auth/login');
      return;
    }

    if (!formData.proposedPrice || Number(formData.proposedPrice) <= 0) {
      toast.error(t('errors.invalidPrice'));
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/call-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId,
          proposedDateTime: formData.proposedDateTime,
          proposedPrice: Number(formData.proposedPrice),
          message: formData.message,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('errors.sendFailed'));
      }

      toast.success(t('success'));
      setOpen(false);
      setFormData({ proposedDateTime: '', proposedPrice: '', message: '' });
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || t('errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          {t('triggerButton')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t('title', { creatorName })}</DialogTitle>
            <DialogDescription>
              {t('description')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="proposedDateTime">{t('form.dateTime')}</Label>
              <Input
                id="proposedDateTime"
                type="datetime-local"
                value={formData.proposedDateTime}
                onChange={(e) => setFormData({ ...formData, proposedDateTime: e.target.value })}
                min={new Date().toISOString().slice(0, 16)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="proposedPrice">{t('form.price')}</Label>
              <Input
                id="proposedPrice"
                type="number"
                step="0.01"
                min="1"
                placeholder="50.00"
                value={formData.proposedPrice}
                onChange={(e) => setFormData({ ...formData, proposedPrice: e.target.value })}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="message">{t('form.message')}</Label>
              <Textarea
                id="message"
                placeholder={t('form.messagePlaceholder')}
                className="min-h-[100px]"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={loading} className="bg-gradient-to-r from-purple-600 to-pink-600">
              {loading ? t('sending') : t('submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
