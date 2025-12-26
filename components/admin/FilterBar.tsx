import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilterOption {
  label: string;
  value: string;
}

interface FilterConfig {
  key: string;
  label: string;
  type: 'select' | 'search';
  options?: FilterOption[];
  placeholder?: string;
}

interface FilterBarProps {
  filters: FilterConfig[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onReset?: () => void;
  className?: string;
}

export function FilterBar({ filters, values, onChange, onReset, className }: FilterBarProps) {
  const hasActiveFilters = Object.values(values).some(v => v !== '');

  return (
    <div className={cn('space-y-4', className)}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {filters.map((filter) => (
          <div key={filter.key} className="space-y-2">
            <Label htmlFor={filter.key}>{filter.label}</Label>
            {filter.type === 'select' ? (
              <Select
                value={values[filter.key] || ''}
                onValueChange={(value) => onChange(filter.key, value)}
              >
                <SelectTrigger id={filter.key}>
                  <SelectValue placeholder={filter.placeholder || 'Sélectionner'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  {filter.options?.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id={filter.key}
                  type="text"
                  placeholder={filter.placeholder || 'Rechercher...'}
                  value={values[filter.key] || ''}
                  onChange={(e) => onChange(filter.key, e.target.value)}
                  className="pl-9"
                />
              </div>
            )}
          </div>
        ))}
      </div>
      {hasActiveFilters && onReset && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onReset}>
            <X className="w-4 h-4 mr-2" />
            Réinitialiser les filtres
          </Button>
        </div>
      )}
    </div>
  );
}
