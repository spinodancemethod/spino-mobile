declare namespace Deno {
    namespace env {
        function get(name: string): string | undefined;
    }

    function serve(
        handler: (req: Request) => Response | Promise<Response>,
    ): void;
}

declare module 'npm:@supabase/supabase-js@2' {
    export * from '@supabase/supabase-js';
}
