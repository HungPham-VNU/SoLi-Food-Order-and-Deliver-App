/**
 * SubmitReviewCommand
 *
 * CQRS command carrying the validated submission inputs plus the
 * authenticated customerId (always sourced from the session, never the body).
 */
export class SubmitReviewCommand {
  constructor(
    public readonly orderId: string,
    public readonly customerId: string,
    public readonly stars: number,
    public readonly comment: string | undefined,
    public readonly tags: string[] | undefined,
  ) {}
}
