/** Joins the defined class names. */
export function cx(...names: Array<string | undefined | false>): string {
    return names.filter(Boolean).join(" ");
}
