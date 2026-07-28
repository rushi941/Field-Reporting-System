/** Show full-page loader only before first data arrives. */
export function showFullPageLoader(loading: boolean, hasContent: boolean) {
  return loading && !hasContent;
}
