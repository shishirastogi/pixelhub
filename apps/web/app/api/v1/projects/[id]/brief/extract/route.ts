import { route } from "@/server/http";
import * as router from "@/server/modules/briefs/router";

export const POST = route(router.extract);
