/** id/name/aria wiring for an admin input whose label, hint and error come from <Field name=...>. */
export function f(name: string) {
  return { id: name, name, "aria-describedby": `${name}-hint ${name}-err` };
}
