use std::ffi::{OsStr, OsString};

/// Append Homebrew locations without changing inherited entries or their order.
/// Keep OS strings so a non-UTF-8 directory does not discard the original PATH.
pub fn macos_path(inherited: Option<&OsStr>) -> OsString {
    let inherited = inherited.unwrap_or_default();
    let entries: Vec<_> = std::env::split_paths(inherited).collect();
    let mut result = inherited.to_os_string();
    for fallback in ["/opt/homebrew/bin", "/usr/local/bin"] {
        if !entries
            .iter()
            .any(|entry| entry == std::path::Path::new(fallback))
        {
            if !result.is_empty() {
                result.push(":");
            }
            result.push(fallback);
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::os::unix::ffi::OsStrExt;

    #[test]
    fn finder_path_gets_both_fallbacks_last() {
        assert_eq!(
            macos_path(Some(OsStr::new("/usr/bin:/bin:/usr/sbin:/sbin"))),
            "/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/usr/local/bin"
        );
    }

    #[test]
    fn existing_fallbacks_keep_their_order_without_duplicates() {
        for original in [
            "/usr/local/bin:/usr/bin:/opt/homebrew/bin",
            "/opt/homebrew/bin:/usr/local/bin:/usr/bin",
        ] {
            assert_eq!(macos_path(Some(OsStr::new(original))), original);
        }
        assert_eq!(
            macos_path(Some(OsStr::new("/usr/local/bin:/usr/bin"))),
            "/usr/local/bin:/usr/bin:/opt/homebrew/bin"
        );
        assert_eq!(
            macos_path(Some(OsStr::new("/opt/homebrew/bin:/usr/bin"))),
            "/opt/homebrew/bin:/usr/bin:/usr/local/bin"
        );
    }

    #[test]
    fn absent_or_empty_path_does_not_add_current_directory() {
        for original in [None, Some(OsStr::new(""))] {
            assert_eq!(macos_path(original), "/opt/homebrew/bin:/usr/local/bin");
        }
    }

    #[test]
    fn preserves_non_utf8_and_empty_entries_and_is_idempotent() {
        let original = OsStr::from_bytes(b"/custom/\xff/bin::/usr/bin:");
        let result = macos_path(Some(original));
        assert_eq!(
            result.as_bytes(),
            b"/custom/\xff/bin::/usr/bin::/opt/homebrew/bin:/usr/local/bin"
        );
        assert_eq!(macos_path(Some(&result)), result);
    }
}
