import { cn } from '@/lib/utils';
import type { HTMLAttributes, TableHTMLAttributes } from 'react';

export const Table = (props: TableHTMLAttributes<HTMLTableElement>) => <table className={cn('w-full text-sm', props.className)} {...props} />;
export const Thead = (props: HTMLAttributes<HTMLTableSectionElement>) => <thead className={cn('border-b', props.className)} {...props} />;
export const Tbody = (props: HTMLAttributes<HTMLTableSectionElement>) => <tbody className={cn('[&_tr:last-child]:border-0', props.className)} {...props} />;
export const Tr = (props: HTMLAttributes<HTMLTableRowElement>) => <tr className={cn('border-b', props.className)} {...props} />;
export const Th = (props: HTMLAttributes<HTMLTableCellElement>) => <th className={cn('px-3 py-3 text-left font-medium text-muted-foreground', props.className)} {...props} />;
export const Td = (props: HTMLAttributes<HTMLTableCellElement>) => <td className={cn('px-3 py-3', props.className)} {...props} />;
