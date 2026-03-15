import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';

export function DataTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-auto rounded-xl border bg-card">
      <Table>
        <Thead><Tr>{headers.map((h) => <Th key={h}>{h}</Th>)}</Tr></Thead>
        <Tbody>{rows.map((r, idx) => <Tr key={idx}>{r.map((c, i) => <Td key={i}>{c}</Td>)}</Tr>)}</Tbody>
      </Table>
    </div>
  );
}
