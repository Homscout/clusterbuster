import { Cache, defaultCacheOptions } from './cache';
import {
  createQueryForTile,
  defaultGetBaseQuery,
  defaultZoomToDistance,
} from './queries/index';
import createSupportingSQLFunctions from './supporting';
import { TileInput, TileRenderer, TileServerConfig } from './types/index';
import { zip } from './zip';

export async function TileServer<T>({
  maxZoomLevel = 12,
  cacheOptions = defaultCacheOptions,
  queryExecutor,
  filtersToWhere = null,
  attributes = [],
  debug = false,
}: TileServerConfig<T>): Promise<TileRenderer<T>> {

  const cache = await Cache(cacheOptions);

  await createSupportingSQLFunctions(queryExecutor);

  return async ({
    z,
    x,
    y,
    table = 'public.points',
    geometry = 'wkb_geometry',
    sourceLayer = 'points',
    maxZoomLevel: requestMaxZoomLevel = undefined,
    cacheTtl = undefined,
    radius = 15,
    extent = 4096,
    bufferSize = 256,
    queryParams = {},
    id = '',
    zoomToDistance = defaultZoomToDistance,
    getBaseQuery = defaultGetBaseQuery,
  }: TileInput<T>) => {
    try {
      const filtersQuery = !!filtersToWhere ? filtersToWhere(queryParams) : [];

      debug && console.time('query' + id);
      const cacheKey = cache.getCacheKey(table, z, x, y, filtersQuery);
      try {
        const value = cacheKey ? await cache.getCacheValue(cacheKey) : null;
        if (value) {
          console.log("Using cached value!");
          return value;
        }
      } catch (e) {
        // In case the cache get fail, we continue to generate the tile
        debug && console.log({ e });
      }
      let query: string = '';

      z = parseInt(`${z}`, 10);
      if (isNaN(z)) {
        throw new Error('Invalid zoom level');
      }

      x = parseInt(`${x}`, 10);
      y = parseInt(`${y}`, 10);
      if (isNaN(x) || isNaN(y)) {
        throw new Error('Invalid tile coordinates');
      }

      try {
        query = createQueryForTile({
          z,
          x,
          y,
          maxZoomLevel: requestMaxZoomLevel || maxZoomLevel,
          table,
          geometry,
          radius,
          sourceLayer,
          extent,
          bufferSize,
          attributes,
          query: filtersQuery,
          debug,
          zoomToDistance,
          getBaseQuery,
        });
        const result = await queryExecutor(query);
        debug && console.timeEnd('query' + id);

        debug && console.time('gzip' + id);
        console.log(result[0].mvt);
        const tile = await zip(result[0].mvt);
        console.log('tile:')
        console.log(tile);
        debug && console.timeEnd('gzip' + id);

        if (cacheKey) {
        try {
          await cache.setCacheValue(
            cacheKey,
            tile,
            await cache.getCacheTtl(z, cacheTtl)
          );
        } catch (e) {
          // In case the cache set fail, we should return the generated tile
          debug && console.log({ e });
        }
      }

        return tile;
      } catch (e) {
        debug && console.log(query);
        debug && console.log({ e });
      }
    } catch (e) {
      debug && console.log('e in connect', e);
    }
  };
}
