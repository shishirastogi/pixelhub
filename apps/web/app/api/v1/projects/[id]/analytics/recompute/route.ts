import { route } from "@/server/http";
import * as router from "@/server/modules/analytics/router";

export const POST = route(router.recompute);
