'use client';

import * as React from "react";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useLocale } from 'next-intl';

interface DateRangePickerProps {
  value: DateRange;
  onChange: (value: DateRange) => void;
  className?: string;
}

export function DateRangePicker({
  value,
  onChange,
  className,
}: DateRangePickerProps) {
  const locale = useLocale();
  const dateFnsLocale = locale === 'fr' ? fr : enUS;
  const placeholderText = locale === 'fr' ? 'Sélectionner une période' : 'Pick a date range';

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[300px] justify-start text-left font-normal",
              !value && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value?.from ? (
              value.to ? (
                <>
                  {format(value.from, "LLL dd, y", { locale: dateFnsLocale })} -{" "}
                  {format(value.to, "LLL dd, y", { locale: dateFnsLocale })}
                </>
              ) : (
                format(value.from, "LLL dd, y", { locale: dateFnsLocale })
              )
            ) : (
              <span>{placeholderText}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={value?.from}
            selected={value}
            onSelect={(value) => onChange(value as DateRange)}
            numberOfMonths={2}
            locale={dateFnsLocale}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
