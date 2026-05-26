export function DevicesTab() {
  return (
    <section className="bg-surface-container-lowest rounded-3xl p-6 md:p-8">
      <div className="mb-4">
        <h3 className="font-headline text-lg font-bold text-on-surface">
          Registered Push Devices
        </h3>
        <p className="font-body text-sm text-on-surface-variant mt-1">
          Devices that receive push notifications for your account.
        </p>
      </div>

      <div className="text-center py-10 border-2 border-dashed border-outline-variant rounded-2xl">
        <span className="material-symbols-outlined text-5xl text-on-surface-variant/50">
          devices
        </span>
        <p className="font-bold text-on-surface mt-3 mb-1">No devices yet</p>
        <p className="text-sm text-on-surface-variant max-w-sm mx-auto">
          Sign in on the mobile app to register your first device for push notifications.
        </p>
      </div>
    </section>
  );
}
