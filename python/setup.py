#!/usr/bin/env python3

from setuptools import setup, find_packages
import os

setup(
    name="remarkablecustomtemplates",
    version="0.0.1",
    description="read, preview, and write custom Remarkable native json templates.",
    author="cuttlefisch",
    author_email="system.cuttle@gmail.com",
    packages=["customtemplates"],
    package_dir={"customtemplates": "src/customtemplates"},
    package_data={
        "customtemplates": ["data/*.template", "data/*.json"],
        "output": ["output"],
    },
    test_suite="nose.collector",
    tests_require=["nose==1.3.7"],
    python_requires=">=3.14",
    classifiers=[
        "Programming Language :: Python :: 3",
        "Operating System :: OS Independent",
    ],
)
