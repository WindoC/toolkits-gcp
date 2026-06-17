import { encodePathSegment } from './api';

test('encodes file ids as URL path segments', () => {
  expect(encodePathSegment('cpython-3.12.13%2B20260610.tar.gz')).toBe('cpython-3.12.13%252B20260610.tar.gz');
});
