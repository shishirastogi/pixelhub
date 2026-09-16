import { route } from "@/server/http";
import * as router from "@/server/modules/brandkit/router";

export const POST = route(router.check);
