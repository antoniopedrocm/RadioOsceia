import { Badge } from '@/components/ui/badge';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';

interface DataTableProps {
  headers: string[];
  rows: (string | number)[][];
}

export function DataTable({ headers, rows }: DataTableProps) {
  return (
    <div className="overflow-auto rounded-xl border bg-card">
      <Table>
        <Thead>
          <Tr>{headers.map((header) => <Th key={header}>{header}</Th>)}</Tr>
        </Thead>
        <Tbody>
          {rows.map((row, idx) => (
            <Tr key={idx}>
              {row.map((cell, index) => (
                <Td key={index}>{String(cell).toLowerCase().includes('ativo') ? <Badge>{cell}</Badge> : cell}</Td>
              ))}
            </Tr>
          ))}
        </Tbody>
      </Table>
    </div>
  );
}
