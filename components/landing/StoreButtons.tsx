import type { StoreLinks } from "@/content/types";

type StoreButtonsProps = {
  store: StoreLinks;
};

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.463 2.21-1.247 3.01-.86.88-2.27 1.56-3.47 1.47-.14-1.1.4-2.25 1.2-3.08.86-.9 2.34-1.55 3.52-1.4zM20.5 17.2c-.58 1.28-.86 1.85-1.61 2.98-.1.15-1.05 1.47-2.45 1.5-1.23.02-1.55-.72-3.22-.72-1.68 0-2.04.7-3.25.74-1.35.04-2.38-1.59-3.26-3.08C5.1 16.55 4 12.9 5.55 10.45c.87-1.37 2.25-2.24 3.8-2.27 1.19-.02 2.31.8 3.22.8.9 0 2.3-1 3.88-.85.66.03 2.5.27 3.69 2.02-3.25 1.77-2.73 6.4.36 7.05z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3.6 2.7c-.35.2-.6.57-.6 1.05v16.5c0 .48.25.85.6 1.05l9.55-9.3L3.6 2.7zm11.05 6.4-2.2 2.15 2.2 2.15 4.55-2.6c.55-.32.55-1.18 0-1.5l-4.55-2.2zM13.2 13.8l-2.35 2.3 4.05 2.3c.9.52 2.05-.12 2.05-1.16v-.05l-3.75-3.39zm-2.35-5.9L4.8 3.6l8.05 4.55 2.2-2.15-4.2-2.1z" />
    </svg>
  );
}

export function StoreButtons({ store }: StoreButtonsProps) {
  return (
    <div className="store-row">
      <a
        className="store-link"
        href={store.appStoreHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={store.appStoreAria}
      >
        <AppleIcon />
        {store.appStoreLabel}
      </a>
      <a
        className="store-link"
        href={store.playStoreHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={store.playStoreAria}
      >
        <PlayIcon />
        {store.playStoreLabel}
      </a>
    </div>
  );
}
