import { route } from "@/server/http";
import * as router from "@/server/modules/projects/router";

export const GET = route(router.get);
export const PATCH = route(router.update);
export const DELETE = route(router.remove);
