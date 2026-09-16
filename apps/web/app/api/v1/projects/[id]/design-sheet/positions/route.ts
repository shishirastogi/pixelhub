import { route } from "@/server/http";
import * as router from "@/server/modules/design-sheet/router";

export const POST = route(router.savePositions);
