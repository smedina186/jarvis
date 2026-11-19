from unittest.mock import patch

from capture.frame_handler import FrameHandler


def test_detector_is_loaded_only_on_first_use() -> None:
    """API startup must not download a YOLO model or initialize inference."""
    with patch("capture.frame_handler.HumanDetector") as detector_class:
        handler = FrameHandler()
        detector_class.assert_not_called()

        assert handler.detector is detector_class.return_value
        assert handler.detector is detector_class.return_value
        detector_class.assert_called_once_with()
