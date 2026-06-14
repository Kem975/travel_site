import { useState } from 'react';
import { Autocomplete, Loader } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import { adminApi, type GeoResult } from '../../api/admin';

type Props = {
  label: string;
  placeholder?: string;
  onPick: (result: GeoResult) => void;
};

/**
 * Type-ahead place search (OpenStreetMap via the /admin/geocode proxy). Picking a
 * suggestion calls onPick with its coordinates so the form can fill lat/lng/country.
 */
export function PlaceSearchField({ label, placeholder, onPick }: Props) {
  const [value, setValue] = useState('');
  const [debounced] = useDebouncedValue(value.trim(), 300);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['admin', 'geocode', debounced],
    queryFn: () => adminApi.geocode(debounced),
    enabled: debounced.length >= 2,
    staleTime: 5 * 60_000,
  });

  const byLabel = new Map(results.map((r) => [r.label, r]));

  return (
    <Autocomplete
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={setValue}
      data={results.map((r) => r.label)}
      // The server already ranks + dedupes — show every result regardless of the raw text.
      filter={({ options }) => options}
      onOptionSubmit={(picked) => {
        const result = byLabel.get(picked);
        if (result) onPick(result);
      }}
      rightSection={isFetching ? <Loader size="xs" /> : undefined}
      comboboxProps={{ withinPortal: true }}
    />
  );
}
