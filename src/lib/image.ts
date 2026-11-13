import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { PickedFile } from './api';

const MAX_SIDE = 1600;

/**
 * Downscale and re-compress a picked photo before it is uploaded or shown. Phone cameras produce 8-25 MB images; the app
 * only ever needs about 1600px, so this keeps uploads quick and the memory used when displaying them small.
 * Anything that is not a large image is returned unchanged.
 */
export async function shrinkImage(file: PickedFile, width?: number, height?: number): Promise<PickedFile> {
  if (!file.type.startsWith('image/') || !width || !height) return file;
  try {
    const ctx = ImageManipulator.manipulate(file.uri);
    if (Math.max(width, height) > MAX_SIDE) ctx.resize(width >= height ? { width: MAX_SIDE } : { height: MAX_SIDE });
    const out = await (await ctx.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.75 });
    return { uri: out.uri, name: file.name.replace(/\.[^.]+$/, '') + '.jpg', type: 'image/jpeg' };
  } catch {
    return file; // never block an upload because optimisation failed
  }
}
