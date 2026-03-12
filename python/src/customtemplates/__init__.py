import json
import importlib.resources
import os.path
import re
from pprint import pprint
from sys import _is_interned
from typing import List, OrderedDict, Tuple, Union, Sequence
from collections import OrderedDict

from pudb import set_trace

# Access local templates and write output relative to module path
SRCDIR = importlib.resources.files("customtemplates")

# Process strings containing ternary statements into groups to eval into floats
# Only support basic ternary operators, no nesting, no OR/AND etc
ternary = re.compile(r"^(\d+\s|\w+\s)([<>]|==)\s(\d|\w+)\s\?\s(\d+|\w+)\s:\s(\d+|\w+)$")
ternary_alt = re.compile(r"^(\S+?)\s?(<|>|==|>=|<=|!=)\s?(\S+)\s?\?\s(\S+)\s?:\s(\S+)$")
# G0: var1
# G1: Comparison Operator
# G2: var2
# G3: val if True
# G4: val if False


class RemarkableStringExp:
    exp: Union[str, float, int] = ""
    is_ternary: bool = False
    groups: Union[tuple, None] = None
    tern_regexp = ternary_alt
    tern_switch = {
        ">": lambda a, b: float(a) > float(b),
        "<": lambda a, b: float(a) < float(b),
        "==": lambda a, b: float(a) == float(b),
        "!=": lambda a, b: float(a) != float(b),
        ">=": lambda a, b: float(a) >= float(b),
        "<=": lambda a, b: float(a) <= float(b),
    }

    def __init__(self, exp: str):
        """Evaluable string containing ternary operator or basic math expression."""
        self.exp = exp
        if match := self.tern_regexp.match(exp):
            self.is_ternary = True
            self.groups = match.groups()

    def _parse_exp(self, constants):
        """Apply expression string to constants and return float result."""

    def eval(self, constants: dict):
        """Apply contants and return result of evaluated ternary operator or exp."""
        if self.is_ternary and self.groups:
            var1, comparison_op, var2, res_true, res_false = self.groups
            comparison_res = self.tern_switch[comparison_op](
                constants[var1], constants[var2]
            )
            return constants[res_true] if comparison_res else constants[res_false]
        if isinstance(self.exp, str):
            # WARN:: Not secure, using eval for initial development simplicity
            return eval(self.exp, locals=constants)
        # Else its a number or invalid :shrug:
        return self.exp

    def __iter__(self):
        return str(f'"{self.exp}"')

    def __str__(self) -> str:
        return str(f'"{self.exp}"')

    def __repr__(self) -> str:
        return str(f'"{self.exp}"')


class RemarkableTemplate:
    src_template = {}
    output_file: str = "debug.template"
    name = ""
    author = ""
    templateVersion = ""
    formatVersion = ""
    categories = []
    orientation = ""
    constants = []
    src_items = []
    items = []
    res: OrderedDict = OrderedDict()

    def __init__(self, filepath, output_file: "debug.template"):
        with open(f"{filepath}", "r") as json_src:
            self.src_template = json.load(json_src, object_pairs_hook=OrderedDict)
        self.name = "DEBUG TEMPLATE"  # self.src_template["name"]
        self.author = self.src_template["author"]
        self.templateVersion = self.src_template["templateVersion"]
        self.formatVersion = self.src_template["formatVersion"]
        self.categories = self.src_template["categories"]
        self.categories.append("DEBUG")
        self.orientation = self.src_template["orientation"]
        self.constants = self.src_template["constants"]
        self.src_items = self.src_template["items"]
        self.output_file = output_file
        self.populate_children()
        self.construct_output_dict()

    def populate_children(self):
        """Construct child object for each Item in items"""
        for item in self.src_items:
            if item["type"] == "text":
                self.items.append(RemarkableText(kwargs=item))
            elif item["type"] == "group":
                self.items.append(RemarkableGroup(kwargs=item))
            elif item["type"] == "path":
                self.items.append(RemarkablePath(kwargs=item))
            else:
                raise ValueError(f"ERROR: Invalid Item type in children:\t{type(item)}")

    def construct_output_dict(self):
        self.res = OrderedDict()
        self.res["name"] = self.name
        self.res["author"] = self.author
        self.res["templateVersion"] = self.templateVersion
        self.res["formatVersion"] = self.formatVersion
        self.res["categories"] = self.categories
        self.res["orientation"] = self.orientation
        self.res["constants"] = self.constants
        _items = []
        for item in self.items:
            _items.append(item.res)
        self.res["items"] = _items

    def json(self):
        """Return json object representing local remarkable template component."""
        self.construct_output_dict()
        return json.dumps(self.res)

    def write_json_template(self):
        """Combine all children JSON and self json into output file."""
        # Ignore lenter
        abs_output_file_path = os.path.join(SRCDIR, "output", self.output_file)
        self.construct_output_dict()
        with open(f"{abs_output_file_path}", "w+") as output_stream:
            json.dump(self.res, output_stream)


class RemarkableGroup:
    _id = ""
    _type = "group"
    boundingBox = {"x": 0, "y": 0, "width": 0, "height": 0}
    repeat = {"rows": 0, "columns": 0}
    src_children = []
    children: List[Union["RemarkableGroup", "RemarkablePath", "RemarkableText"]] = []
    res: OrderedDict = OrderedDict()

    def __init__(self, *args, **kwargs):
        kwargs = kwargs["kwargs"]
        if not "id" in kwargs.keys():
            self._id = f"GROUP--{self.__hash__()}"
        else:
            self._id = kwargs["id"]
        if not "repeat" in kwargs.keys():
            self.repeat = {"rows": 0, "columns": 0}
        else:
            self.repeat = kwargs["repeat"]
        print(f"ID::\t {self._id}")
        self.boundingBox = kwargs["boundingBox"]
        self.src_children = kwargs["children"]
        # pprint(self.src_children)
        self.populate_children()
        self.construct_output_dict()
        # self.construct_output_dict()

    def construct_output_dict(self):
        """Return ordered dict of class attrs to values."""
        self.res = OrderedDict()
        self.res["id"] = self._id
        self.res["type"] = self._type
        self.res["boundingBox"] = self.boundingBox
        self.res["repeat"] = self.repeat
        _children = []
        for child in self.children:
            _children.append(child.res)
        self.res["children"] = _children
        # self.res["children"] = self.children

    def populate_children(self):
        for item in self.src_children:
            print(f"ITEM-TYPE::\t{item['type']}")
            if item["type"] == "text":
                self.children.append(RemarkableText(kwargs=item))
            elif item["type"] == "group":
                self.children.append(RemarkableGroup(kwargs=item))
            elif item["type"] == "path":
                self.children.append(RemarkablePath(kwargs=item))
            else:
                raise ValueError(f"ERROR: Invalid Item type in children:\t{type(item)}")

    def json(self):
        """Return json object representing local remarkable template component."""
        self.construct_output_dict()
        return json.dumps(self.res)


class RemarkableText:
    _id: str = ""
    _type: str = "text"
    text: str = ""
    fontSize: int = 8
    position: dict = {"x": 0, "y": 0}
    res: OrderedDict = OrderedDict()

    def __init__(self, *args, **kwargs):
        kwargs = kwargs["kwargs"]
        if not "id" in kwargs.keys():
            self._id = f"TEXT--{self.__hash__()}"
        else:
            self._id = kwargs["id"]
        if not "text" in kwargs.keys():
            self.text = "penis"
        else:
            self.text = kwargs["text"]
        self.position = kwargs["position"]
        self.fontsize = kwargs["fontSize"]
        print(f"ID::\t {self._id}")
        self.construct_output_dict()

    def construct_output_dict(self):
        """Return ordered dict of class attrs to values."""
        self.res = OrderedDict()
        self.res["id"] = self._id
        self.res["type"] = self._type
        self.res["text"] = self.text
        self.res["fontSize"] = self.fontSize
        self.res["position"] = self.position

    def json(self):
        """Return json object representing local remarkable template component."""
        self.construct_output_dict()
        pprint(self.res)
        return json.dumps(self.res)


class RemarkablePath:
    _id = ""
    _type: str = "path"
    fillColor = "#ffffff"
    strokeColor = "#000000"
    strokeWidth = 0
    antialiasing: str = "true"
    data = []
    res: OrderedDict = OrderedDict()

    def __init__(self, *args, **kwargs):
        kwargs = kwargs["kwargs"]
        if not "id" in kwargs.keys():
            self._id = f"PATH--{self.__hash__()}"
        else:
            self._id = kwargs["id"]
        # set_trace()
        self.data = kwargs["data"]
        if not "fillCollor" in kwargs.keys():
            self.fillColor = "#ffffff"
        else:
            self.fillColor = kwargs["fillColor"]
        if not "strokeColor" in kwargs.keys():
            self.strokeColor = "#000000"
        else:
            self.strokeColor = kwargs["strokeColor"]
        if not "strokeWidth" in kwargs.keys():
            self.strokeWidth = 1
        else:
            self.strokeWidth = kwargs["strokeWidth"]
        if not "antialiasing" in kwargs.keys():
            self.antialiasing = "true"
        else:
            self.antialiasing = kwargs["antialiasing"]
        print(f"ID::\t {self._id}")
        self.construct_output_dict()

    def construct_output_dict(self):
        """Return ordered dict of class attrs to values."""
        self.res = OrderedDict()
        self.res["id"] = self._id
        self.res["type"] = self._type
        self.res["fillColor"] = self.fillColor
        self.res["strokeColor"] = self.strokeColor
        self.res["strokeWidth"] = self.strokeWidth
        self.res["antialiasing"] = self.antialiasing
        self.res["data"] = self.data

    def json(self):
        """Return json object representing local remarkable template component."""
        self.construct_output_dict()
        return json.dumps(self.res)


class RemarkablePathData:
    """Represents path data as a list for a RemarkablePath."""

    src_data: List[
        Union[
            "RemarkablePoint",
            "RemarkableLine",
            "RemarkablePolygon",
            "RemarkableCurve",
            float,
            str,
        ]
    ]
    data: List[
        Union[
            "RemarkablePoint", "RemarkableLine", "RemarkablePolygon", "RemarkableCurve"
        ]
    ] = []

    def __init__(self, src_data: List = []):
        """Parse pathdata for points, lines, polygons, initialize them as objects."""
        # Index based searching with simultaneousobject construction
        # -------------------------------------------------
        # identifier is every third index, starting from index 0
        # if identifier is "M" or "L" next two indices represent point pair
        #   if next identifier is "M" new line segment, else its a polygon
        # if identifier is "C" next 6 indicies represent point pairs
        # if idenfifier is "Z" end of polygon reached
        # use list.pop until list consumed
        #
        # Index based searching building objects delayed
        # --------------------------------------------------------------
        # Select first point or invalid if not point: ID "M"
        # scan forward until index matches either:
        #   end of list found
        #   new point found: ID "M"
        #   end of polygon found: ID "Z"
        # As scanning
        #
        #
        # Once end index found:
        #   determine
        #
        #
        # Scan into ordered dicto
        # -------------------
        # crawl index across src data
        # when
        index = 0
        if src_data and src_data[index] != "M":
            raise ValueError('ERROR: Polygons, Lines must begin with Point "M", x, y.')
        # each list entry is OrderedDict where first key is "M", first val is Mx My
        # if length OderedDict.keys() is 1: Point
        # if length OrderedDict.keys() is 2: Line
        # if length OrderedDict.keys() is > 2: Closed Polygon
        pathdata = []
        while index < len(src_data):
            cur_id = src_data[index]
            final_component_index = index  + 2# simplest case is point
            if cur_id == "Z":
                # End 
                break
            if final_component_index > len()
            raise IndexError(
                f"ERROR: Pathdata terminated unexpectedly at index:\t{index}!"
            )
            if cur_id == "L":
                final_component_index = index + 2

            raise IndexError(
                f"ERROR: Pathdata terminated unexpectedly at index:\t{index}!"
            )

    def __repr__(self) -> str:
        return ",".join(map(str, self.data))


class RemarkablePathAtom:
    identifier = '"Z"'


class RemarkablePoint(RemarkablePathAtom):
    """Single Point drawn in Remarkable representing marker down and up again."""

    identifier = '"M"'
    x: Union[float, RemarkableStringExp] = 0
    y: Union[float, RemarkableStringExp] = 0

    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __repr__(self) -> str:
        return ",".join(map(str, [self.identifier, self.x, self.y]))


class RemarkableSegment(RemarkablePoint):
    """Destination point in remarkable lines, only difference from *point is identifier."""

    identifier = "L"


class RemarkableCurve:
    """BUG doesn't work yet, represents bezier curve item fount in piano sheets."""

    identifier = "C"
    x: Tuple[Union[float, RemarkableStringExp], Union[float, RemarkableStringExp]] = (
        0,
        0,
    )
    y: Tuple[Union[float, RemarkableStringExp], Union[float, RemarkableStringExp]] = (
        0,
        0,
    )
    z: Tuple[Union[float, RemarkableStringExp], Union[float, RemarkableStringExp]] = (
        0,
        0,
    )  # TODO no clue if this one is control point

    def __init__(self):
        pass

    def __repr__(self) -> str:
        pass


class RemarkableLine:
    """Single line segment with a start and end point. Markder down, up after x2,y2."""

    identifier = "L"
    start: Union[RemarkablePoint, "RemarkableLine"] = None
    end_x: Union[float, RemarkableStringExp] = 0
    end_y: Union[float, RemarkableStringExp] = 0

    def __init__(self, x1, y1, x2, y2):
        self.start = RemarkablePoint(x1, y1)
        self.end_x = x2
        self.end_y = y2

    def __repr__(self) -> str:
        return ",".join(map(str, [self.start, self.identifier, self.end_x, self.end_y]))


class RemarkablePolygon:
    """Closed Polygon consisting of a RemarkablePoint and series of RemarkableLines."""

    origin: RemarkablePoint
    segments: List[RemarkableSegment] = []
    segment_identifier = "L"

    def __init__(
        self,
        points: List[
            tuple[Union[float, RemarkableStringExp], Union[float, RemarkableStringExp]]
        ],
    ):
        """Create initial point and series of lines."""
        self.origin = RemarkablePoint(*points[0])
        for p in points[1:]:
            self.add_segment(*p)

    def add_segment(self, x, y):
        self.segments.append(RemarkableSegment(x, y))

    def pop_segment(self):
        if len(self.segments) < 1:
            raise ValueError("Too few segments to pop.")
        self.segments = self.segments[:-1]

    def move_lastpoint(self, new_x, new_y):
        self.pop_segment()
        self.add_segment(new_x, new_y)

    def move_origin(self, new_x, new_y):
        self.origin = RemarkablePoint(new_x, new_y)

    def __repr__(self) -> str:
        return ",".join(map(str, [self.origin, *self.segments, '"Z"']))


def main():
    rmt = RemarkableTemplate(f"{SRCDIR}/data/P Week 2.template", "debug.template")
    print(rmt.json())
    rmt.write_json_template()


if __name__ == "__main__":
    main()
