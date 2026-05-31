import { Skeleton } from '@/components/ui/skeleton';

const HomePageSkeleton = () => {
  return (
    <div className="min-h-screen bg-background safe-top">
      {/* Header */}
      <div className="gradient-hero px-6 pt-8 pb-6">
        <div className="flex flex-col">
          <div className="flex justify-center mb-4">
            <Skeleton className="w-20 h-20 rounded-full" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-4 w-16 mb-2" />
              <Skeleton className="h-8 w-32" />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6 space-y-6">
        {/* Quick Action Card */}
        <Skeleton className="h-28 w-full rounded-2xl" />

        {/* Stats */}
        <div>
          <Skeleton className="h-6 w-40 mb-4" />
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <Skeleton className="h-6 w-36 mb-4" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
};

export default HomePageSkeleton;
