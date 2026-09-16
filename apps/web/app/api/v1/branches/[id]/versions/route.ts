import { route } from "@/server/http";
import * as router from "@/server/modules/versions/router";

export const GET = route(router.list);
export const POST = route(router.create);
