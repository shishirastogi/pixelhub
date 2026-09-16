import { route } from "@/server/http";
import * as router from "@/server/modules/briefs/router";

export const GET = route(router.get);
export const PUT = route(router.update);
