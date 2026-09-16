import { route } from "@/server/http";
import * as router from "@/server/modules/brandkit/router";

export const GET = route(router.get);
export const PUT = route(router.save);
