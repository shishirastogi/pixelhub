import { route } from "@/server/http";
import * as router from "@/server/modules/design-sheet/router";

export const GET = route(router.list);
export const POST = route(router.create);
