import { Item, isCurve, isPath, isShape } from "@owlbear-rodeo/sdk";
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

/** Is the item's position covered by the given fog path */
export function isCoveredByFog(
  item: Item,
  fogPath: PathKit.SkPath | undefined
): boolean {
  if (!fogPath) {
    return false;
  }
  try {
    // PathKit has no point-in-path query so intersect the fog
    // with a tiny probe square around the item's position instead
    const pk = getPathKit();
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
