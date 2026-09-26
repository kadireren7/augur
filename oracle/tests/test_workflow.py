from __future__ import annotations

import unittest

from oracle.workflow import ChainlinkCREWorkflowAdapter


class WorkflowBoundaryTests(unittest.TestCase):
    def test_unconfigured_cre_adapter_fails_explicitly(self) -> None:
        adapter = ChainlinkCREWorkflowAdapter()
        with self.assertRaisesRegex(RuntimeError, "not configured"):
            adapter.validate(None)


if __name__ == "__main__":
    unittest.main()
