export const COMPLETION_HELP = `siteforge completion — shell tab-completion.

Usage:
  siteforge completion <bash|zsh|fish>

  # bash
  eval "$(siteforge completion bash)"
  # zsh (fpath)
  siteforge completion zsh > ~/.zsh/completions/_siteforge
  # fish
  siteforge completion fish > ~/.config/fish/completions/siteforge.fish
`;

const COMMANDS = "init video add fx 3d record audit ship skills assets agents mcp completion doctor update help";

const FLAGS: Record<string, string> = {
  video: "--fps --width --height --name --quality --pm --no-upscale --no-install --no-build --help",
  add: "--dir --list --help",
  fx: "--dir --list --letter --bg --fg --help",
  "3d": "--dir --list --help",
  record: "--out --viewport --establish --step --delay --hold --crf --browser --keep-raw --help",
  audit: "--widths --budget --browser --help",
  ship: "--repo --private --message --no-push --help",
  skills: "--agent --global --list --help",
  agents: "--force --help",
  mcp: "--help",
  completion: "--help",
  assets: "--format --quality --max-width --dry-run --help",
  init: "--video --dir --fps --sections --fx --help",
};

const ADD_NAMES = "hero hero-grid navbar about work skills experience contact pricing faq testimonials gallery";
const FX_NAMES = "cursor badge progress reveal favicon smooth marquee preloader magnetic";
const THREE_NAMES = "particle terrain shapes orb model";
const AGENT_NAMES = "claude cursor opencode codex aider pi";

export function renderCompletion(shell: string): string {
  switch (shell) {
    case "bash":
      return `# siteforge bash completion
_siteforge_complete() {
  local cur prev cmds words
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  if [ "$COMP_CWORD" -eq 1 ]; then
    COMPREPLY=( $(compgen -W "${COMMANDS}" -- "$cur") )
    return 0
  fi
  local cmd="\${COMP_WORDS[1]}"
  case "$cmd" in
    add) COMPREPLY=( $(compgen -W "${ADD_NAMES} --dir --list --help" -- "$cur") ) ;;
    fx) COMPREPLY=( $(compgen -W "${FX_NAMES} --dir --list --letter --bg --fg --help" -- "$cur") ) ;;
    3d) COMPREPLY=( $(compgen -W "${THREE_NAMES} --dir --list --help" -- "$cur") ) ;;
    skills) COMPREPLY=( $(compgen -W "install --list --agent --global --help ${AGENT_NAMES}" -- "$cur") ) ;;
    completion) COMPREPLY=( $(compgen -W "bash zsh fish" -- "$cur") ) ;;
    *) local flags=""
       case "$cmd" in
${Object.entries(FLAGS).map(([c, f]) => `         ${c}) flags="${f}" ;;`).join("\n")}
       esac
       COMPREPLY=( $(compgen -W "$flags" -- "$cur") ) ;;
  esac
  return 0
}
complete -F _siteforge_complete siteforge
`;
    case "zsh":
      return `#compdef siteforge
_siteforge() {
  local -a commands=(
    'init:Guided new site' 'video:Video to scroll site' 'add:Add a section'
    'fx:Add an effect' '3d:Add a 3D scene' 'record:Record a demo'
    'audit:Audit a page' 'ship:Commit and push' 'skills:Agent skills'
    'agents:Write AGENTS.md' 'mcp:Serve MCP tools' 'completion:Shell completion'
    'assets:Optimize images' 'doctor:Check machine' 'update:Self-update'
  )
  _arguments -C '1: :->cmd' '*:: :->args'
  case $state in
    cmd) _describe 'command' commands ;;
    args)
      case $words[1] in
        add) _describe 'section' "(${ADD_NAMES.split(" ").map((n) => n + ":section").join(" ")})" ;;
        fx) _describe 'effect' "(${FX_NAMES.split(" ").map((n) => n + ":effect").join(" ")})" ;;
        3d) _describe 'preset' "(${THREE_NAMES.split(" ").map((n) => n + ":preset").join(" ")})" ;;
      esac ;;
  esac
}
_siteforge
`;
    case "fish":
      return `# siteforge fish completion
set -l commands init video add fx 3d record audit ship skills assets agents mcp completion doctor update help
complete -c siteforge -f -n __fish_use_subcommand -a "$commands"
complete -c siteforge -f -n '__fish_seen_subcommand_from add' -a "${ADD_NAMES}"
complete -c siteforge -f -n '__fish_seen_subcommand_from fx' -a "${FX_NAMES}"
complete -c siteforge -f -n '__fish_seen_subcommand_from 3d' -a "${THREE_NAMES}"
complete -c siteforge -s h -l help --description 'Show help'
complete -c siteforge -l json --description 'Machine-readable output'
`;
    default:
      throw new Error(`Unknown shell "${shell}". Choose: bash, zsh, fish.`);
  }
}

export function parseCompletionArgs(argv: string[]): string {
  if (argv.length === 0) throw new Error("Missing <shell>. Usage: siteforge completion <bash|zsh|fish>");
  if (argv.length > 1) throw new Error("Too many arguments for completion.");
  return argv[0];
}
