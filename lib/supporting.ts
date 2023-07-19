import { QueryFn } from './types';

export default async function createSupportingSQLFunctions(query: QueryFn) {
    await query(`
      CREATE OR REPLACE FUNCTION public.first_agg ( anyelement, anyelement )
      RETURNS anyelement LANGUAGE SQL IMMUTABLE STRICT AS $$
              SELECT $1;
      $$;
      
      CREATE OR REPLACE AGGREGATE public.FIRST (
              sfunc    = public.first_agg,
              basetype = anyelement,
              stype    = anyelement
      );`
    );
    await query(`
      create or replace function TileBBox (z int, x int, y int, srid int = 3857)
          returns geometry
          language plpgsql immutable as
      $func$
      declare
          max numeric := 20037508.34;
          res numeric := (max*2)/(2^z);
          bbox geometry;
      begin
          bbox := ST_MakeEnvelope(
              -max + (x * res),
              max - (y * res),
              -max + (x * res) + res,
              max - (y * res) - res,
              3857
          );
          if srid = 3857 then
              return bbox;
          else
              return ST_Transform(bbox, srid);
          end if;
      end;
      $func$;`
    );
    await query(`
      create or replace function TileDoubleBBox (z int, x int, y int, srid int = 3857)
          returns geometry
          language plpgsql immutable as
      $func$
      declare
          max numeric := 20037508.34;
          res numeric := (max*2)/(2^z);
          bbox geometry;
      begin
          bbox := ST_MakeEnvelope(
              -max + ((x) * res),
              max - ((y) * res),
              -max + (x * res) + res * 2,
              max - (y * res) - res * 2,
              3857
          );
          if srid = 3857 then
              return bbox;
          else
              return ST_Transform(bbox, srid);
          end if;
      end;
      $func$;`
    );
}
