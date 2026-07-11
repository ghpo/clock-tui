import { execFile, exec } from 'child_process';
import { NextRequest } from 'next/server';

export interface WidgetRunRequest {
  command: string | string[];
  timeout_secs: number;
  theme?: string;
}

export interface WidgetRunResponse {
  ok: boolean;
  output: string;
  error?: string;
}

function runCommand(cmd: string | string[], timeoutSecs: number, theme?: string): Promise<WidgetRunResponse> {
  return new Promise((resolve) => {
    const env: Record<string, string | undefined> = { ...process.env };
    if (theme) {
      // Map unknown themes to default — retro is purely visual/frontend
      const mappedTheme = ['default', 'nerv'].includes(theme) ? theme : 'default';
      env['TCLOCK_WIDGET_THEME'] = mappedTheme;
    }

    const args = Array.isArray(cmd) ? cmd : [cmd];

    if (Array.isArray(cmd) && cmd.length > 0) {
      execFile(cmd[0], cmd.slice(1), {
        timeout: timeoutSecs * 1000,
        maxBuffer: 64 * 1024,
        env: env as NodeJS.ProcessEnv,
      }, (error, stdout, stderr) => {
        if (error) {
          if ((error as any).killed) {
            resolve({ ok: false, output: '', error: `[timeout] Command timed out after ${timeoutSecs}s` });
          } else {
            const msg = stderr ? `[error] ${stderr}` : `[error] ${error.message}`;
            resolve({ ok: false, output: '', error: msg });
          }
          return;
        }
        resolve({ ok: true, output: stdout || '' });
      });
    } else {
      const cmdStr = typeof cmd === 'string' ? cmd : args.join(' ');
      exec(cmdStr, {
        timeout: timeoutSecs * 1000,
        maxBuffer: 64 * 1024,
        shell: true as any,
        env: env as NodeJS.ProcessEnv,
      }, (error, stdout, stderr) => {
        if (error) {
          if ((error as any).killed) {
            resolve({ ok: false, output: '', error: `[timeout] Command timed out after ${timeoutSecs}s` });
          } else {
            const msg = stderr ? `[error] ${stderr}` : `[error] ${error.message}`;
            resolve({ ok: false, output: '', error: msg });
          }
          return;
        }
        resolve({ ok: true, output: stdout || '' });
      });
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    const body: WidgetRunRequest = await request.json();
    const { command, timeout_secs, theme } = body;

    if (!command || (Array.isArray(command) && command.length === 0)) {
      return Response.json({ ok: false, output: '', error: '[error] No command provided' }, { status: 400 });
    }

    const result = await runCommand(command, timeout_secs || 30, theme);
    return Response.json(result);
  } catch (e) {
    return Response.json({
      ok: false,
      output: '',
      error: `[error] ${e instanceof Error ? e.message : 'Unknown error'}`,
    }, { status: 500 });
  }
}
