import { Item, isCurve, isImage, isPath, isShape } from "@owlbear-rodeo/sdk";
import { curve } from "./icons/items/CurveIcon";
import { getPathKit } from "./pathkit";

/**
 * Build a world-space path covering all fog in the scene.
 * Fog cut as holes inside fog paths is handled by the path fill rule and
 * fog shapes toggled invisible (cut by this extension) are skipped.
 * Returns `undefined` when PathKit hasn't finished loading yet.
 */
export function buildFogPath(
  items: Item[],
  filled: boolean
): PathKit.SkPath | undefined {
  let pk: PathKit.PathKitApi;
  try {
    pk = getPathKit();
  } catch {
    return undefined;
  }

  const fogPath = pk.NewPath();

  try {
    if (filled) {
      // Filled fog covers the entire scene
      fogPath.rect(-1e9, -1e9, 2e9, 2e9);
    } else {
      // Without the fill, visible fog shapes are the fogged areas
      for (const item of items) {
        if (item.layer !== "FOG" || !item.visible) {
          continue;
        }
        const itemPath = fogItemToPath(pk, item);
        if (itemPath) {
          itemPath.transform(getTransformMatrix(item));
          fogPath.op(itemPath, pk.PathOp.UNION);
          itemPath.delete();
        }
      }
    }

    // Cut fog shapes (toggled invisible) reveal their area
    for (const item of items) {
      if (item.layer !== "FOG" || item.visible) {
        continue;
      }
      const itemPath = fogItemToPath(pk, item);
      if (itemPath) {
        itemPath.transform(getTransformMatrix(item));
        fogPath.op(itemPath, pk.PathOp.DIFFERENCE);
        itemPath.delete();
      }
    }

    return fogPath;
  } catch (error) {
    // Never let a fog computation error blank the outliner
    console.error("Failed to build fog path", error);
    fogPath.delete();
    return undefined;
  }
}

/**
 * Is the item fully covered by the given fog path.
 * Items that are even partially out of the fog count as not covered.
 */
export function isCoveredByFog(
  item: Item,
  fogPath: PathKit.SkPath | undefined,
  sceneDpi: number
): boolean {
  if (!fogPath) {
    return false;
  }
  try {
    const pk = getPathKit();

    const area = itemAreaToPath(pk, item, sceneDpi);
    if (area) {
      // Covered when nothing of the item's area is left outside the fog
      area.transform(getTransformMatrix(item));
      area.op(fogPath, pk.PathOp.DIFFERENCE);
      const covered = area.toCmds().length === 0;
      area.delete();
      return covered;
    }

    // No known extents: probe the item's position with a tiny square
    const probe = pk.NewPath();
    probe.rect(item.position.x - 0.5, item.position.y - 0.5, 1, 1);
    probe.op(fogPath, pk.PathOp.INTERSECT);
    const covered = probe.toCmds().length > 0;
    probe.delete();
    return covered;
  } catch (error) {
    console.error("Failed to test fog coverage", error);
    return false;
  }
}

/** The local-space area of an item, or undefined when its extents are unknown */
function itemAreaToPath(
  pk: PathKit.PathKitApi,
  item: Item,
  sceneDpi: number
): PathKit.SkPath | undefined {
  if (isImage(item)) {
    // Images are sized in image pixels mapped onto the scene grid
    const factor = sceneDpi / item.grid.dpi;
    const path = pk.NewPath();
    path.rect(
      -item.grid.offset.x * factor,
      -item.grid.offset.y * factor,
      item.image.width * factor,
      item.image.height * factor
    );
    return path;
  }
  return fogItemToPath(pk, item);
}

/** Convert a fog item's geometry to a local-space path */
function fogItemToPath(
  pk: PathKit.PathKitApi,
  item: Item
): PathKit.SkPath | undefined {
  if (isCurve(item)) {
    const path = pk.NewPath();
    curve(item, path);
    // Fog curves describe an area so always treat them as closed
    path.closePath();
    return path;
  } else if (isPath(item)) {
    const path = pk.FromCmds(item.commands);
    path.setFillType(
      item.fillRule === "nonzero" ? pk.FillType.WINDING : pk.FillType.EVENODD
    );
    return path;
  } else if (isShape(item)) {
    const path = pk.NewPath();
    if (item.shapeType === "RECTANGLE") {
      path.rect(0, 0, item.width, item.height);
    } else if (item.shapeType === "TRIANGLE") {
      path.moveTo(0, 0);
      path.lineTo(item.width / 2, item.height);
      path.lineTo(-item.width / 2, item.height);
      path.closePath();
    } else {
      // CIRCLE and HEXAGON (approximated) are centered on the position
      path.ellipse(
        0,
        0,
        item.width / 2,
        item.height / 2,
        0,
        0,
        Math.PI * 2,
        false
      );
    }
    return path;
  }
  return undefined;
}

/** Local-to-world transform of an item as a 3x3 row-major matrix */
function getTransformMatrix(item: Item): number[] {
  const radians = (item.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return [
    cos * item.scale.x,
    -sin * item.scale.y,
    item.position.x,
    sin * item.scale.x,
    cos * item.scale.y,
    item.position.y,
    0,
    0,
    1,
  ];
}
