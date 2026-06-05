/**
 * Returns whether a path already has non-relative behavior.
 * @param path -
 * @returns -
 */
export function isAbsoluteOrSpecialPath(path: string): boolean {
	return (
		path.startsWith('/')
		|| path.startsWith('#')
		|| path.startsWith('//')
		|| /^[a-z][a-z\d+.-]*:/iu.test(path)
	);
}
