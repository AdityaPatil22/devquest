import subprocess
import sys
import webbrowser
from pathlib import Path

import typer

app = typer.Typer(name="devquest", help="DevQuest - Engineering Decision Simulator")


@app.command()
def start(
    repo: str = typer.Option(".", help="Path to the repository to analyze"),
    host: str = typer.Option("127.0.0.1", help="Server host"),
    port: int = typer.Option(8000, help="Server port"),
    skill_mode: bool = typer.Option(False, help="Run in skill mode (no built-in AI)"),
    no_browser: bool = typer.Option(False, help="Don't open browser automatically"),
):
    """Start a DevQuest session."""
    repo_path = Path(repo).resolve()
    if not repo_path.exists():
        typer.echo(f"Error: Repository path '{repo_path}' does not exist", err=True)
        raise typer.Exit(1)

    typer.echo(f"🎮 Starting DevQuest...")
    typer.echo(f"   Repository: {repo_path}")
    typer.echo(f"   Server:     http://{host}:{port}")
    typer.echo(f"   Mode:       {'skill' if skill_mode else 'standalone'}")
    typer.echo()

    if not no_browser:
        webbrowser.open(f"http://{host}:{port}")

    subprocess.run(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            host,
            "--port",
            str(port),
            "--reload",
        ],
        cwd=Path(__file__).parent.parent,
    )


@app.command()
def resume(
    session_id: str = typer.Argument(help="Session ID to resume"),
    host: str = typer.Option("127.0.0.1"),
    port: int = typer.Option(8000),
):
    """Resume a previous DevQuest session."""
    typer.echo(f"🔄 Resuming session {session_id}...")
    # TODO: implement resume
    typer.echo("Not yet implemented")


@app.command()
def export(
    session_id: str = typer.Argument(None, help="Session ID (latest if omitted)"),
    format: str = typer.Option("json", help="Export format: json, markdown"),
):
    """Export session decisions."""
    typer.echo(f"📦 Exporting session...")
    # TODO: implement export
    typer.echo("Not yet implemented")


if __name__ == "__main__":
    app()
