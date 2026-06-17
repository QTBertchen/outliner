import Search from "@mui/icons-material/esm/SearchRounded";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import { useRef } from "react";

export function SearchField({
  value,
  onChange,
  expanded,
  onExpand,
}: {
  value: string;
  onChange: (value: string) => void;
  expanded: boolean;
  onExpand: (expand: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const searching = Boolean(value);

  return (
    <Collapse
      in={expanded}
      timeout="auto"
      orientation="horizontal"
      collapsedSize={40}
    >
      <div>
        {!expanded && (
          <IconButton
            onClick={() => {
              onExpand(true);
              ref.current?.focus();
            }}
          >
            <Search />
          </IconButton>
        )}
        <TextField
          variant="outlined"
          placeholder="Search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
            type: "search",
            "aria-label": "search",
            sx: { borderRadius: "20px" },
          }}
          onBlur={() => {
            if (!searching) {
              onExpand(false);
            }
          }}
          onFocus={() => {
            onExpand(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              ref.current?.blur();
            }
          }}
          size="small"
          inputRef={ref}
          sx={{
            width: expanded ? "218px" : "0",
            opacity: expanded ? 1 : 0,
          }}
        />
      </div>
    </Collapse>
  );
}
