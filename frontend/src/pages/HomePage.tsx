import { useQuery } from '@tanstack/react-query';
import { Box, Center, Loader } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { publicApi } from '../api/public';
import { LazyGlobe } from '../components/globe/LazyGlobe';

// The homepage IS the interactive globe (plan §6.1). Header nav (Journal /
// Gallery / About) stays persistent above it.
export function HomePage() {
  const navigate = useNavigate();
  const { data: trips, isLoading } = useQuery({ queryKey: ['globe'], queryFn: publicApi.globe });

  const fallback = (
    <Center h="100%">
      <Loader />
    </Center>
  );

  return (
    <Box style={{ height: 'calc(100dvh - 92px)', minHeight: 420, borderRadius: 10, overflow: 'hidden' }}>
      {isLoading ? (
        fallback
      ) : (
        <LazyGlobe
          trips={trips ?? []}
          interactive
          fallback={fallback}
          onOpen={(place) => navigate(`/trips/${place.trip_slug}/${place.slug}`)}
        />
      )}
    </Box>
  );
}
