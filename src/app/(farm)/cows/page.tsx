'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Search, ArrowUpRight, Beef } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ActionForm, Choice } from '@/components/farm/forms';
import { cowFields } from '@/components/farm/cow-fields';
import { PageHeading, LoadState, Empty, Status, Pager } from '@/components/farm/common';
import { useCanManage } from '@/components/farm/shell';
import { useResource } from '@/lib/api';
import { label } from '@/lib/utils';
import type { Cow, List } from '@/lib/types';
export default function CowsPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [status, setStatus] = useState('ACTIVE');
  const [page, setPage] = useState(1);
  const manage = useCanManage();
  const q = useResource<List<Cow>>(
    `cows?page=${page}&limit=20&search=${encodeURIComponent(search)}${category === 'ALL' ? '' : `&category=${category}`}${status === 'ALL' ? '' : `&status=${status}`}`,
  );
  const add = <ActionForm title="Add cow" fields={cowFields} path="cows" onSuccess={q.refresh} />;
  return (
    <>
      <PageHeading
        title="My cattle"
        description="Individual records for every animal on your farm."
        action={manage && add}
      />
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-52">
          <Search size={17} className="absolute left-3 top-3 text-muted-foreground" />
          <Input
            aria-label="Search cattle"
            placeholder="Search tag or name…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-10 bg-white"
          />
        </div>
        <div className="w-40">
          <Choice
            value={category}
            onChange={(v) => {
              setCategory(v);
              setPage(1);
            }}
            options={[
              { value: 'ALL', label: 'All categories' },
              ...['DAIRY', 'BEEF', 'HEIFER', 'CALF'].map((v) => ({ value: v, label: label(v) })),
            ]}
          />
        </div>
        <div className="w-40">
          <Choice
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            options={[
              { value: 'ALL', label: 'All statuses' },
              ...['ACTIVE', 'SOLD', 'DECEASED', 'TRANSFERRED'].map((v) => ({
                value: v,
                label: label(v),
              })),
            ]}
          />
        </div>
      </div>
      <LoadState {...q} retry={q.refresh} />
      {q.data &&
        (q.data.items.length ? (
          <>
            <div className="border rounded-xl bg-white overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Animal</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Breed</TableHead>
                    <TableHead>Sex</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>
                      <span className="sr-only">Open profile</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {q.data.items.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="pl-5">
                        <Link href={`/cows/${c.id}`} className="flex items-center gap-3 py-2">
                          <span className="size-10 bg-secondary text-primary rounded-lg grid place-items-center">
                            <Beef size={20} />
                          </span>
                          <span>
                            <span className="block font-semibold">{c.tagNumber}</span>
                            <span className="text-muted-foreground text-sm">
                              {c.name || 'Unnamed'}
                            </span>
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell>{label(c.category)}</TableCell>
                      <TableCell>{c.breed || '—'}</TableCell>
                      <TableCell>{label(c.sex)}</TableCell>
                      <TableCell>
                        <Status value={c.status} />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/cows/${c.id}`} aria-label={`Open ${c.tagNumber}`}>
                            <ArrowUpRight size={17} />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pager page={page} total={q.data.total} onChange={setPage} />
          </>
        ) : (
          <Empty
            title="No cattle found"
            description="Add your first cow or change the search filters."
            action={manage && add}
          />
        ))}
    </>
  );
}
