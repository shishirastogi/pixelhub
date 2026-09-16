export interface WatchOptions {
  /** Absolute path to the project folder being watched. */
  root: string;
}

/**
 * Watch loop described in docs/06-file-watcher.md §3:
 * initial scan → reconcile → chokidar watch → debounce bursts → ingest.
 *
 * TODO: implement scan/hash/watch/ingest. Scaffold only.
 */
export async function startWatching(options: WatchOptions): Promise<void> {
  throw new Error(`pixelhub-watch: watcher not implemented yet (root: ${options.root})`);
}
