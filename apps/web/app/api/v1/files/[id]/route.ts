import { route } from "@/server/http";
import * as router from "@/server/modules/files/router";

export const GET = route(router.get);
export const DELETE = route(router.remove);
