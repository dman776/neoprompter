import type { NeoprompterApi } from './preload';

declare global {
  interface Window {
    neoprompter: NeoprompterApi;
  }
}
