// PostgREST sends `.in(column, ids)` as part of the request URL, and the edge
// gateway closes the HTTP/2 stream once that URL passes roughly 16 KB — about
// 400 uuids. The professor Gradebook hit it on 2026-10-15 with one term of
// posted class grades (449 score ids in a single grade_adjustments lookup).
//
// Any lookup whose id list grows with the term — scores, attempts, responses —
// goes through here: the ids are split into fixed-size batches, the batches run
// concurrently, and the rows are concatenated. Row order is preserved only
// within a batch, so a query whose `.order(...)` matters across the whole set
// must sort the merged rows itself, or key the order by something that cannot
// straddle two batches (e.g. "latest per id" when the batches are split by that
// same id).

export const IN_CHUNK_SIZE = 100;

type ChunkResult<Row> = { data: Row[] | null; error: { message: string } | null };

export async function inChunks<Row>(
  ids: string[],
  query: (chunk: string[]) => PromiseLike<ChunkResult<Row>>,
  size = IN_CHUNK_SIZE
): Promise<Row[]> {
  const chunks: string[][] = [];
  for (let start = 0; start < ids.length; start += size) {
    chunks.push(ids.slice(start, start + size));
  }
  const results = await Promise.all(chunks.map((chunk) => query(chunk)));
  const rows: Row[] = [];
  for (const result of results) {
    if (result.error) throw result.error;
    rows.push(...(result.data || []));
  }
  return rows;
}
