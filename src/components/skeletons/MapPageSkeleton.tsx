import { Skeleton } from '@/components/ui/skeleton';

const MapPageSkeleton = () => {
  return (
    <div className="min-h-screen bg-background safe-top pb-24">
      {/* Header */}
      <div className="px-6 pt-8 pb-4">
        <Skeleton className="h-8 w-24 mb-4" />
        <Skeleton className="h-12 w-full rounded-md" />
      </div>

      {/* Map */}
      <div className="mx-6">
        <Skeleton className="h-[300px] w-full rounded-xl" />
      </div>

      {/* Nearby Gyms List */}
      <div className="px-6 py-6">
        <Skeleton className="h-6 w-36 mb-4" />
        
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
              <Skeleton className="w-12 h-12 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MapPageSkeleton;
