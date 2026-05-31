import { Skeleton } from '@/components/ui/skeleton';

const ProfilePageSkeleton = () => {
  return (
    <div className="min-h-screen bg-background safe-top">
      {/* Header */}
      <div className="gradient-hero px-6 pt-8 pb-6">
        <Skeleton className="h-8 w-32" />
      </div>

      <div className="px-6 py-6 space-y-6">
        {/* Profile Card */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-card">
          <div className="flex items-center gap-4">
            <Skeleton className="w-16 h-16 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-5 w-32 mb-2" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </div>

        {/* Stats Summary */}
        <div>
          <Skeleton className="h-6 w-24 mb-4" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </div>
        </div>

        {/* Menu */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-card">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 border-b border-border last:border-b-0">
              <Skeleton className="w-10 h-10 rounded-xl" />
              <Skeleton className="h-5 flex-1" />
              <Skeleton className="w-5 h-5" />
            </div>
          ))}
        </div>

        {/* Logout */}
        <Skeleton className="h-12 w-full rounded-md" />
      </div>
    </div>
  );
};

export default ProfilePageSkeleton;
