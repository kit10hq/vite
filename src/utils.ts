/**
 * Returns whether a URL already has non-relative behavior.
 * @param url URL.
 * @returns Whether the URL should be left as-is.
 */
export function isAbsoluteOrSpecialUrl(url: string): boolean {
	return (
		url.startsWith('/')
		|| url.startsWith('#')
		|| url.startsWith('//')
		|| /^[a-z][a-z\d+.-]*:/iu.test(url)
	);
}
