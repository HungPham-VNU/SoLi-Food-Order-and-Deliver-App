import { useState } from 'react';
import { useRestaurantReviews } from '../hooks/useRestaurantReviews';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Star } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { PaginationControls } from './PaginationControls';

const PAGE_SIZE = 20;

export function ReviewsTab({ restaurantId }: { restaurantId: string }) {
  const [page, setPage] = useState(0);
  const { data, isLoading } = useRestaurantReviews(restaurantId, {
    page: page + 1,
    limit: PAGE_SIZE,
  });

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const reviews = data?.data || [];
  const distribution = data?.ratingDistribution || {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };
  const total = data?.total || 0;

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-[300px_1fr] gap-6">
        <Card>
          <CardContent className="p-6 flex flex-col items-center justify-center h-full">
            <div className="text-5xl font-bold mb-2">
              {data?.averageRating.toFixed(1) || '0.0'}
            </div>
            <div className="flex gap-1 text-yellow-500 mb-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  className={`h-5 w-5 ${i <= Math.round(data?.averageRating || 0) ? 'fill-current' : 'text-muted'}`}
                />
              ))}
            </div>
            <div className="text-muted-foreground">{total} total reviews</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 space-y-3">
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = distribution[stars] || 0;
              const percent = total > 0 ? (count / total) * 100 : 0;
              return (
                <div key={stars} className="flex items-center gap-4">
                  <div className="w-12 text-sm flex items-center gap-1">
                    {stars}{' '}
                    <Star className="h-3 w-3 fill-current text-muted-foreground" />
                  </div>
                  <Progress value={percent} className="flex-1 h-2" />
                  <div className="w-12 text-sm text-right text-muted-foreground">
                    {count}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Reviews</h3>
        {reviews.length === 0 ? (
          <p className="text-muted-foreground">No reviews found.</p>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <Card key={review.id}>
                <CardContent className="p-4 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <div className="flex text-yellow-500">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${i < review.stars ? 'fill-current' : 'text-muted'}`}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(review.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        User ID: {review.customerId.split('-')[0]}
                      </div>
                    </div>
                    <Badge
                      variant={
                        review.moderationStatus === 'visible'
                          ? 'outline'
                          : 'destructive'
                      }
                    >
                      {review.moderationStatus}
                    </Badge>
                  </div>

                  {review.comment && (
                    <p className="text-sm">{review.comment}</p>
                  )}

                  {review.tags && review.tags.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {review.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="text-xs font-normal"
                        >
                          {tag.replace('_', ' ')}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        <PaginationControls
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
